package com.personal.dashboard.api;

import com.personal.dashboard.entity.TaskEntity;
import com.personal.dashboard.model.TaskItem;
import com.personal.dashboard.model.User;
import com.personal.dashboard.repo.TaskRepository;
import com.personal.dashboard.service.StatsService;
import com.personal.dashboard.service.TaskOrderService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 工作任务管理器 API（数据按登录用户隔离）
 */
@RestController
@RequestMapping("/api/tasks")
public class TaskApiController {

    private final StatsService stats;
    private final TaskRepository repo;
    private final TaskOrderService taskOrder;

    public TaskApiController(StatsService stats, TaskRepository repo, TaskOrderService taskOrder) {
        this.stats = stats;
        this.repo = repo;
        this.taskOrder = taskOrder;
    }

    /**
     * 任务列表。view:
     * all 全部 | today 今日待办 | daily 每日必做 | weekly 每周必做 | week 本周待办
     * | overdue 逾期任务 | high 高优先级 | report 需向领导汇报 | done 已完成
     */
    @GetMapping
    public List<TaskItem> list(@RequestParam(defaultValue = "all") String view,
                               @RequestAttribute("currentUser") User user) {
        List<TaskItem> tasks = stats.tasks(user.username());
        return switch (view) {
            case "today" -> tasks.stream().filter(t -> t.status() != TaskItem.Status.DONE
                    && (t.isDueToday() || t.dueDate() == null)).toList();
            case "daily" -> tasks.stream().filter(t -> t.repeatType() == TaskItem.RepeatType.DAILY).toList();
            case "weekly" -> tasks.stream().filter(t -> t.repeatType() == TaskItem.RepeatType.WEEKLY).toList();
            case "week" -> tasks.stream().filter(TaskItem::isDueThisWeek).toList();
            case "overdue" -> tasks.stream().filter(TaskItem::isOverdue).toList();
            case "high" -> tasks.stream().filter(TaskItem::isHighPriority).toList();
            case "report" -> tasks.stream().filter(t -> t.needReport() && t.status() != TaskItem.Status.DONE).toList();
            case "done" -> tasks.stream().filter(t -> t.status() == TaskItem.Status.DONE).toList();
            default -> tasks;
        };
    }

    public record CreateRequest(String title, TaskItem.Priority priority, String dueDate,
                                boolean needReport, List<String> capabilities, String note,
                                String category, String source, String nextStep,
                                String expectedOutcome, String blocker, String repeatType) {}

    public record OrderRequest(List<TaskOrderService.OrderItem> tasks) {}

    @PostMapping
    public TaskItem create(@Valid @RequestBody CreateRequest req,
                           @RequestAttribute("currentUser") User user) {
        TaskItem task = TaskItem.create(req.title(), req.priority(),
                req.dueDate() == null || req.dueDate().isBlank() ? null : java.time.LocalDate.parse(req.dueDate()),
                req.needReport(), req.capabilities(), req.note(),
                blank(req.category()), blank(req.source()), blank(req.nextStep()),
                blank(req.expectedOutcome()), blank(req.blocker()), parseRepeat(req.repeatType()));
        int position = repo.findMaxPositionByOwner(user.username()) + 1;
        task = task.withOrder(position, 0);
        repo.save(TaskEntity.from(task, user.username()));
        return task;
    }

    @PutMapping("/order")
    public List<TaskItem> reorder(@RequestBody OrderRequest req,
                                  @RequestAttribute("currentUser") User user) {
        return taskOrder.reorder(user.username(), req.tasks());
    }

    @PutMapping("/{id}")
    public ResponseEntity<TaskItem> update(@PathVariable String id, @RequestBody CreateRequest req,
                                           @RequestAttribute("currentUser") User user) {
        return repo.findByIdAndOwner(id, user.username()).map(e -> {
            TaskItem old = e.toRecord();
            TaskItem merged = new TaskItem(id, req.title(),
                    req.priority() == null ? old.priority() : req.priority(),
                    req.dueDate() == null || req.dueDate().isBlank() ? null : java.time.LocalDate.parse(req.dueDate()),
                    old.status(), req.needReport(),
                    req.capabilities() == null ? old.capabilities() : req.capabilities(),
                    req.note(), old.createdAt(), old.completedAt(),
                    blank(req.category()), blank(req.source()), blank(req.nextStep()),
                    blank(req.expectedOutcome()), blank(req.blocker()), parseRepeat(req.repeatType()),
                    old.position(), old.version());
            repo.save(TaskEntity.from(merged, user.username()));
            return ResponseEntity.ok(merged);
        }).orElseThrow(() -> ApiException.notFound("任务不存在"));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<TaskItem> complete(@PathVariable String id,
                                             @RequestAttribute("currentUser") User user) {
        return changeStatus(id, TaskItem.Status.DONE, user);
    }

    @PostMapping("/{id}/reopen")
    public ResponseEntity<TaskItem> reopen(@PathVariable String id,
                                           @RequestAttribute("currentUser") User user) {
        return changeStatus(id, TaskItem.Status.TODO, user);
    }

    private ResponseEntity<TaskItem> changeStatus(String id, TaskItem.Status status, User user) {
        return repo.findByIdAndOwner(id, user.username()).map(e -> {
            TaskItem updated = e.toRecord().withStatus(status);
            // 重复任务完成时，截止时间自动推进到下一周期（下次恢复待做后不再误报逾期）
            if (status == TaskItem.Status.DONE) {
                updated = updated.withNextOccurrence();
            }
            repo.save(TaskEntity.from(updated, user.username()));
            return ResponseEntity.ok(updated);
        }).orElseThrow(() -> ApiException.notFound("任务不存在"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable String id,
                                                      @RequestAttribute("currentUser") User user) {
        return repo.findByIdAndOwner(id, user.username()).map(e -> {
            repo.deleteById(id);
            return ResponseEntity.ok(Map.<String, Object>of("deleted", true));
        }).orElseThrow(() -> ApiException.notFound("任务不存在"));
    }

    /** 清空当前用户的全部任务 */
    @DeleteMapping
    public Map<String, Object> clearAll(@RequestAttribute("currentUser") User user) {
        List<TaskEntity> mine = repo.findByOwnerOrderByPositionAscCreatedAtAsc(user.username());
        repo.deleteAll(mine);
        return Map.of("deleted", mine.size());
    }

    /** 一键备份：导出当前用户全部任务为 JSON 文件 */
    @GetMapping("/export")
    public ResponseEntity<List<TaskItem>> export(@RequestAttribute("currentUser") User user) {
        String filename = java.net.URLEncoder.encode("任务备份-" + user.username() + "-"
                        + java.time.LocalDate.now() + ".json", java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename*=UTF-8''" + filename)
                .body(stats.tasks(user.username()));
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static TaskItem.RepeatType parseRepeat(String r) {
        if (r == null) return TaskItem.RepeatType.NONE;
        return switch (r.toUpperCase()) {
            case "DAILY" -> TaskItem.RepeatType.DAILY;
            case "WEEKLY" -> TaskItem.RepeatType.WEEKLY;
            default -> TaskItem.RepeatType.NONE;
        };
    }
}
