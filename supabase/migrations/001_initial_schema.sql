-- Households: links users together
CREATE TABLE households (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL DEFAULT 'Ons Huishouden',
    telegram_chat_id TEXT,
    invite_code     TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Members of a household
CREATE TABLE household_members (
    household_id    UUID REFERENCES households(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (household_id, user_id)
);

-- Products: the core grocery item with timing
CREATE TABLE products (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id        UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
    name                TEXT NOT NULL,
    category            TEXT,
    days_until_empty    INT NOT NULL DEFAULT 7,
    remind_days_before  INT NOT NULL DEFAULT 2,
    last_restocked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    status              TEXT NOT NULL DEFAULT 'stocked'
                        CHECK (status IN ('stocked', 'reminded', 'on_list', 'bought')),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    added_by            UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- View: products with computed timing fields
CREATE VIEW products_with_timing AS
SELECT
    p.*,
    p.last_restocked_at + (p.days_until_empty * interval '1 day') AS runs_out_at,
    p.last_restocked_at + ((p.days_until_empty - p.remind_days_before) * interval '1 day') AS remind_at,
    GREATEST(
        0,
        EXTRACT(EPOCH FROM
            (p.last_restocked_at + (p.days_until_empty * interval '1 day')) - now()
        ) / 86400
    )::INT AS days_remaining
FROM products p
WHERE p.is_active = true;

-- Reminder log for tracking sent notifications
CREATE TABLE reminder_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
    sent_at     TIMESTAMPTZ DEFAULT now(),
    message     TEXT
);

-- Indexes
CREATE INDEX idx_products_household ON products(household_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_household_members_user ON household_members(user_id);

-- Row Level Security
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_log ENABLE ROW LEVEL SECURITY;

-- Policy: users can see their own households
CREATE POLICY "Users can view own households"
    ON households FOR SELECT
    USING (id IN (
        SELECT hm.household_id FROM household_members hm WHERE hm.user_id = auth.uid()
    ));

-- Policy: users can insert households (when creating one)
CREATE POLICY "Users can create households"
    ON households FOR INSERT
    WITH CHECK (true);

-- Policy: users can update own households
CREATE POLICY "Users can update own households"
    ON households FOR UPDATE
    USING (id IN (
        SELECT hm.household_id FROM household_members hm WHERE hm.user_id = auth.uid()
    ));

-- Policy: users can see household members — no self-reference to avoid infinite recursion
CREATE POLICY "Users can view own household members"
    ON household_members FOR SELECT
    USING (user_id = auth.uid());

-- Policy: users can join households (insert themselves)
CREATE POLICY "Users can join households"
    ON household_members FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy: users can view products of their households
CREATE POLICY "Users can view own products"
    ON products FOR SELECT
    USING (household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    ));

-- Policy: users can insert products to their households
CREATE POLICY "Users can add products"
    ON products FOR INSERT
    WITH CHECK (household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    ));

-- Policy: users can update products in their households
CREATE POLICY "Users can update products"
    ON products FOR UPDATE
    USING (household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    ));

-- Policy: users can delete products in their households
CREATE POLICY "Users can delete products"
    ON products FOR DELETE
    USING (household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    ));

-- Policy: users can view reminder logs for their products
CREATE POLICY "Users can view reminder logs"
    ON reminder_log FOR SELECT
    USING (product_id IN (
        SELECT p.id FROM products p
        JOIN household_members hm ON p.household_id = hm.household_id
        WHERE hm.user_id = auth.uid()
    ));

-- Allow the service role to read all data for cron jobs
-- (The check-reminders endpoint uses the service role key)
