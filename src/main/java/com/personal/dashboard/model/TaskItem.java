package com.personal.dashboard.model;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 工作任务（对应「工作任务管理器」）
 */
public record TaskItem(
        String id,
        @NotBlank String title,
        Priority priority,
        LocalDate dueDate,
        Status status,
        boolean needReport,
        List<String> capabilities,
        String note,
        LocalDateTime createdAt,
        LocalDateTime completedAt,
        // ---- 扩展字段（新增任务完整表单） ----
        String category,        // 工作分类：德育 / 教学 / 教研 / 行政 / 安全 / 家校 / 其他
        String source,          // 任务来源：如 学部主任安排 / 德育部
        String nextStep,        // 下一步具体做什么
        String expectedOutcome, // 预期成果
        String blocker,         // 阻塞点
        RepeatType repeatType   // 重复类型：NONE 普通 / DAILY 每日必做 / WEEKLY 每周必做
) {
    public enum Priority { P0, P1, P2 }
    public enum Status { TODO, DOING, DONE }
    public enum RepeatType { NONE, DAILY, WEEKLY }

    /** 新建任务（简版，兼容 AI 识别导入） */
    public static TaskItem create(String title, Priority priority, LocalDate dueDate,
                                  boolean needReport, List<String> capabilities, String note) {
        return create(title, priority, dueDate, needReport, capabilities, note,
                null, null, null, null, null, RepeatType.NONE);
    }

    /** 新建任务（完整表单） */
    public static TaskItem create(String title, Priority priority, LocalDate dueDate,
                                  boolean needReport, List<String> capabilities, String note,
                                  String category, String source, String nextStep,
                                  String expectedOutcome, String blocker, RepeatType repeatType) {
        return new TaskItem(UUID.randomUUID().toString(), title,
                priority == null ? Priority.P2 : priority, dueDate, Status.TODO,
                needReport, capabilities == null ? List.of() : capabilities,
                note, LocalDateTime.now(), null,
                category, source, nextStep, expectedOutcome, blocker,
                repeatType == null ? RepeatType.NONE : repeatType);
    }

    public TaskItem withStatus(Status newStatus) {
        return new TaskItem(id, title, priority, dueDate, newStatus, needReport,
                capabilities, note, createdAt,
                newStatus == Status.DONE ? LocalDateTime.now() : null,
                category, source, nextStep, expectedOutcome, blocker, repeatType);
    }

    public boolean isOverdue() {
        return status != Status.DONE && dueDate != null && dueDate.isBefore(LocalDate.now());
    }

    public boolean isDueToday() {
        return status != Status.DONE && dueDate != null && dueDate.equals(LocalDate.now());
    }

    public boolean isHighPriority() {
        return status != Status.DONE && (priority == Priority.P0 || priority == Priority.P1);
    }

    /** 本周待办：未完成且截止日落在本周（周一~周日）内 */
    public boolean isDueThisWeek() {
        if (status == Status.DONE || dueDate == null) return false;
        LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);
        LocalDate sunday = monday.plusDays(6);
        return !dueDate.isBefore(monday) && !dueDate.isAfter(sunday);
    }

    /**
     * 重复任务完成时，将截止时间推进到下一周期：
     * 每日必做 → 次日；每周必做 → 下周同一天。
     * 若已逾期，则循环推进到第一个未来日期，保证新截止时间始终在未来。
     */
    public TaskItem withNextOccurrence() {
        if (repeatType == null || repeatType == RepeatType.NONE) return this;
        java.time.Period period = repeatType == RepeatType.DAILY
                ? java.time.Period.ofDays(1) : java.time.Period.ofWeeks(1);
        LocalDate today = LocalDate.now();
        // 提前完成时以原截止时间为界，逾期完成时以今天为界
        LocalDate threshold = dueDate != null && dueDate.isAfter(today) ? dueDate : today;
        LocalDate next = dueDate != null ? dueDate : threshold;
        do {
            next = next.plus(period);
        } while (!next.isAfter(threshold));
        return new TaskItem(id, title, priority, next, status, needReport,
                capabilities, note, createdAt, completedAt,
                category, source, nextStep, expectedOutcome, blocker, repeatType);
    }

    /**
     * 重复任务是否需要自动恢复为待做：
     * 每日必做——完成时间早于今天；每周必做——完成时间早于本周一。
     */
    public boolean needsReopen() {
        if (status != Status.DONE || completedAt == null || repeatType == null) return false;
        LocalDate doneDate = completedAt.toLocalDate();
        return switch (repeatType) {
            case DAILY -> doneDate.isBefore(LocalDate.now());
            case WEEKLY -> doneDate.isBefore(LocalDate.now().with(java.time.DayOfWeek.MONDAY));
            default -> false;
        };
    }
}
