CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at timestamptz,
    nickname VARCHAR(255),
    avatar_url VARCHAR(255),
    locale VARCHAR(50),
    signin_type VARCHAR(50),
    signin_ip VARCHAR(255),
    signin_provider VARCHAR(50),
    signin_openid VARCHAR(255),
    invite_code VARCHAR(255) NOT NULL default '',
    updated_at timestamptz,
    invited_by VARCHAR(255) NOT NULL default '',
    is_affiliate BOOLEAN NOT NULL default false,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at timestamptz,
    password_hash VARCHAR(255), -- 用于邮箱注册用户的密码
    UNIQUE (email, signin_provider)
);

-- 为 users 表添加重要索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_uuid ON users(uuid);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_signin_provider ON users(signin_provider);
CREATE INDEX idx_users_email_verified ON users(email_verified);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_no VARCHAR(255) UNIQUE NOT NULL,
    created_at timestamptz,
    user_uuid VARCHAR(255) NOT NULL DEFAULT '',
    user_email VARCHAR(255) NOT NULL DEFAULT '',
    amount INT NOT NULL,
    interval VARCHAR(50),
    expired_at timestamptz,
    status VARCHAR(50) NOT NULL,
    stripe_session_id VARCHAR(255),
    credits INT NOT NULL,
    currency VARCHAR(50),
    sub_id VARCHAR(255),
    sub_interval_count int,
    sub_cycle_anchor int,
    sub_period_end int,
    sub_period_start int,
    sub_times int,
    product_id VARCHAR(255),
    product_name VARCHAR(255),
    valid_months int,
    order_detail TEXT,
    paid_at timestamptz,
    paid_email VARCHAR(255),
    paid_detail TEXT
);

-- 为 orders 表添加重要索引
CREATE INDEX idx_orders_user_uuid ON orders(user_uuid);
CREATE INDEX idx_orders_user_email ON orders(user_email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_paid_at ON orders(paid_at);


CREATE TABLE apikeys (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(100),
    user_uuid VARCHAR(255) NOT NULL,
    created_at timestamptz,
    status VARCHAR(50)
);

-- 为 apikeys 表添加索引
CREATE INDEX idx_apikeys_user_uuid ON apikeys(user_uuid);
CREATE INDEX idx_apikeys_status ON apikeys(status);

CREATE TABLE credits (
    id SERIAL PRIMARY KEY,
    trans_no VARCHAR(255) UNIQUE NOT NULL,
    created_at timestamptz,
    user_uuid VARCHAR(255) NOT NULL,
    trans_type VARCHAR(50) NOT NULL,
    credits INT NOT NULL,
    order_no VARCHAR(255),
    expired_at timestamptz
);

-- 为 credits 表添加索引
CREATE INDEX idx_credits_user_uuid ON credits(user_uuid);
CREATE INDEX idx_credits_trans_type ON credits(trans_type);
CREATE INDEX idx_credits_created_at ON credits(created_at);
CREATE INDEX idx_credits_expired_at ON credits(expired_at);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255),
    title VARCHAR(255),
    description TEXT,
    content TEXT,
    created_at timestamptz,
    updated_at timestamptz,
    status VARCHAR(50),
    cover_url VARCHAR(255),
    author_name VARCHAR(255),
    author_avatar_url VARCHAR(255),
    locale VARCHAR(50)
);

-- 为 posts 表添加索引
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_at ON posts(created_at);
CREATE INDEX idx_posts_locale ON posts(locale);

create table affiliates (
    id SERIAL PRIMARY KEY,
    user_uuid VARCHAR(255) NOT NULL,
    created_at timestamptz,
    status VARCHAR(50) NOT NULL default '',
    invited_by VARCHAR(255) NOT NULL,
    paid_order_no VARCHAR(255) NOT NULL default '',
    paid_amount INT NOT NULL default 0,
    reward_percent INT NOT NULL default 0,
    reward_amount INT NOT NULL default 0
);

-- 为 affiliates 表添加索引
CREATE INDEX idx_affiliates_user_uuid ON affiliates(user_uuid);
CREATE INDEX idx_affiliates_invited_by ON affiliates(invited_by);
CREATE INDEX idx_affiliates_status ON affiliates(status);

CREATE TABLE feedbacks (
    id SERIAL PRIMARY KEY,
    created_at timestamptz,
    status VARCHAR(50),
    user_uuid VARCHAR(255),
    content TEXT,
    rating INT
);

-- 为 feedbacks 表添加索引
CREATE INDEX idx_feedbacks_user_uuid ON feedbacks(user_uuid);
CREATE INDEX idx_feedbacks_status ON feedbacks(status);
CREATE INDEX idx_feedbacks_created_at ON feedbacks(created_at);

-- 邮箱验证码表
CREATE TABLE email_verifications (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'register', 'reset_password', 'change_email'
    created_at timestamptz DEFAULT NOW(),
    expires_at timestamptz NOT NULL,
    verified_at timestamptz,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    is_used BOOLEAN DEFAULT FALSE,
    user_uuid VARCHAR(255)
);

-- 为 email_verifications 表添加索引
CREATE INDEX idx_email_verifications_email_code ON email_verifications(email, code);
CREATE INDEX idx_email_verifications_expires_at ON email_verifications(expires_at);
CREATE INDEX idx_email_verifications_type ON email_verifications(type);
CREATE INDEX idx_email_verifications_is_used ON email_verifications(is_used);