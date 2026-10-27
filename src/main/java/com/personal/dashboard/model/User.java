package com.personal.dashboard.model;

/**
 * 用户账号：level 1=最高权限（全部内容），2=除复盘与人才筛选外全部，3=仅驾驶舱/任务/提醒
 * assessmentStatus: NONE（未评估）/ SKIPPED（已跳过，功能禁用）/ COMPLETED（已完成）
 */
public record User(
        String username,
        String name,
        int level,
        String salt,
        String passwordHash,
        String assessmentStatus
) {
    public User withAssessmentStatus(String newStatus) {
        return new User(username, name, level, salt, passwordHash, newStatus);
    }
}
