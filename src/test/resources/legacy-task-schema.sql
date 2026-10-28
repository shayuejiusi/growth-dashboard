CREATE TABLE tasks (
    id VARCHAR(255) PRIMARY KEY,
    owner VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    priority VARCHAR(255) NOT NULL,
    due_date DATE,
    status VARCHAR(255) NOT NULL,
    need_report BOOLEAN NOT NULL,
    capabilities_json CLOB,
    note VARCHAR(2000),
    created_at TIMESTAMP,
    completed_at TIMESTAMP,
    category VARCHAR(50),
    source VARCHAR(200),
    next_step VARCHAR(500),
    expected_outcome VARCHAR(500),
    blocker VARCHAR(500),
    repeat_type VARCHAR(10) NOT NULL
);

INSERT INTO tasks (
    id, owner, title, priority, due_date, status, need_report,
    capabilities_json, repeat_type
) VALUES (
    'legacy-task', 'admin', '历史任务', 'P1', CURRENT_DATE, 'TODO', FALSE,
    '[]', 'NONE'
);
