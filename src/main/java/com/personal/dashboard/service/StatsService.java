package com.personal.dashboard.service;

import com.personal.dashboard.entity.TaskEntity;
import com.personal.dashboard.model.TaskItem;
import com.personal.dashboard.repo.TaskRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 任务数据的统计（驾驶舱 / 提醒中心 / 复盘共用）。
 * 数据存于数据库 tasks 表。
 */
@Service
public class StatsService {

    private final TaskRepository repo;

    public StatsService(TaskRepository repo) {
        this.repo = repo;
    }

    /** 指定用户的全部任务（数据按用户隔离）；读取时对每日/每周必做任务做自动恢复 */
    public List<TaskItem> tasks(String owner) {
        List<TaskEntity> entities = repo.findByOwner(owner);
        List<TaskItem> tasks = new java.util.ArrayList<>();
        for (TaskEntity e : entities) {
            TaskItem t = e.toRecord();
            if (t.needsReopen()) {
                // 恢复为待做的同时，把已逾期的截止时间推进到下一周期
                t = t.withStatus(TaskItem.Status.TODO).withNextOccurrence();
                repo.save(TaskEntity.from(t, owner));
            } else if (t.repeatType() != null && t.repeatType() != TaskItem.RepeatType.NONE && t.isOverdue()) {
                // 重复任务已逾期：截止时间自动滚动到下一未来周期，不再误报逾期
                t = t.withNextOccurrence();
                repo.save(TaskEntity.from(t, owner));
            }
            tasks.add(t);
        }
        return List.copyOf(tasks);
    }

    /** 任务统计指标（按用户） */
    public Map<String, Object> taskStats(String owner) {
        List<TaskItem> tasks = tasks(owner);
        long open = tasks.stream().filter(t -> t.status() != TaskItem.Status.DONE).count();
        long overdue = tasks.stream().filter(TaskItem::isOverdue).count();
        long high = tasks.stream().filter(TaskItem::isHighPriority).count();
        long needReport = tasks.stream().filter(t -> t.needReport() && t.status() != TaskItem.Status.DONE).count();
        long done = tasks.stream().filter(t -> t.status() == TaskItem.Status.DONE).count();
        long dueToday = tasks.stream().filter(TaskItem::isDueToday).count();
        long completionRate = tasks.isEmpty() ? 0 : Math.round(done * 100.0 / tasks.size());

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", tasks.size());
        stats.put("open", open);
        stats.put("todayDue", dueToday);
        stats.put("overdue", overdue);
        stats.put("highPriority", high);
        stats.put("needReport", needReport);
        stats.put("completedTotal", done);
        stats.put("completionRate", completionRate);
        stats.put("reportedCount", needReport);
        return stats;
    }

    /** 今日最重要的 3 件事：P0 > P1 > P2，同优先级按截止日升序（按用户） */
    public List<TaskItem> top3(String owner) {
        return tasks(owner).stream()
                .filter(t -> t.status() != TaskItem.Status.DONE)
                .sorted(Comparator.comparing(TaskItem::priority)
                        .thenComparing(t -> t.dueDate() == null ? LocalDate.MAX : t.dueDate()))
                .limit(3)
                .toList();
    }
}
