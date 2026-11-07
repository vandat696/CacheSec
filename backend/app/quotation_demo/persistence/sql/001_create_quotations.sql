CREATE TABLE quotation_demo.quotations (
    id uuid PRIMARY KEY,
    supplier_name text NOT NULL,
    description text NOT NULL,
    total_amount text NOT NULL
        CONSTRAINT quotation_amount_decimal CHECK (
            total_amount ~ '^[+-]?[0-9]+([.][0-9]+)?$'
        ),
    currency text NOT NULL,
    expires_on json
);
