package com.personal.dashboard.api;

import com.personal.dashboard.model.TaskItem;
import com.personal.dashboard.service.StatsService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 今日驾驶舱 + 待办提醒中心 API
 */
@RestController
@RequestMapping("/api")
public class DashboardController {

    private final StatsService stats;

    public DashboardController(StatsService stats) {
        this.stats = stats;
    }

    /** 今日驾驶舱：统计卡片 + TOP3 + 焦点提示（按当前用户） */
    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@RequestAttribute("currentUser") com.personal.dashboard.model.User user) {
        Map<String, Object> taskStats = stats.taskStats(user.username());
        List<TaskItem> top3 = stats.top3(user.username());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        out.put("stats", taskStats);
        out.put("top3", top3);
        out.put("focusNow", focusTip(taskStats, top3));
        return out;
    }

    /** 待办提醒中心：今日截止 / 逾期 / 高优先级 / 需汇报 / 周期事项 五组 + 话术（按当前用户） */
    @GetMapping("/reminders")
    public Map<String, Object> reminders(@RequestAttribute("currentUser") com.personal.dashboard.model.User user) {
        List<TaskItem> tasks = stats.tasks(user.username());
        Map<String, Object> groups = new LinkedHashMap<>();
        groups.put("todayDue", tasks.stream().filter(TaskItem::isDueToday)
                .filter(t -> t.repeatType() == TaskItem.RepeatType.NONE).toList());
        groups.put("overdue", tasks.stream().filter(TaskItem::isOverdue).toList());
        groups.put("highPriority", tasks.stream().filter(TaskItem::isHighPriority).toList());
        groups.put("needReport", tasks.stream().filter(t -> t.needReport() && t.status() != TaskItem.Status.DONE).toList());
        // 周期事项：每日/每周必做单独成组，按截止时间升序，与一次性任务区分开
        groups.put("recurring", tasks.stream()
                .filter(t -> t.status() != TaskItem.Status.DONE && t.repeatType() != null
                        && t.repeatType() != TaskItem.RepeatType.NONE)
                .sorted(java.util.Comparator.comparing(t -> t.dueDate() == null ? java.time.LocalDate.MAX : t.dueDate()))
                .toList());

        Map<String, Object> taskStats = stats.taskStats(user.username());
        List<Map<String, String>> scripts = List.of(
                Map.of("scene", "同步任务状态",
                        "text", "今日例行检查：待办 %s 项，其中逾期 %s 项、高优先级 %s 项，整体按计划推进。"
                                .formatted(taskStats.get("open"), taskStats.get("overdue"), taskStats.get("highPriority"))),
                Map.of("scene", "向领导汇报进度",
                        "text", "汇报进展：当前未完成 %s 项，完成率 %s%%，重点事项均有留痕，后续新增任务会第一时间登记。"
                                .formatted(taskStats.get("open"), taskStats.get("completionRate"))),
                Map.of("scene", "新增任务响应口径",
                        "text", "收到新任务后立即确认负责人与截止时间并录入，带汇报要求或 P0/P1 优先级的会在下一次检查中重点标注。"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        out.put("phase", phaseOfDay());
        out.put("stats", taskStats);
        out.put("reminders", groups);
        out.put("scripts", scripts);
        out.put("focusNow", focusTip(taskStats, stats.top3(user.username())));
        return out;
    }

    private String phaseOfDay() {
        int hour = LocalDateTime.now().getHour();
        if (hour < 12) return "早间检查";
        if (hour < 17) return "午后跟进";
        return "晚间复盘";
    }

    private String focusTip(Map<String, Object> ts, List<TaskItem> top3) {
        if (((Number) ts.get("total")).intValue() == 0) {
            return "任务清单为空：请先录入今日任务（或用「文档识别生成待办」）。";
        }
        if (((Number) ts.get("overdue")).intValue() > 0) {
            return "有 " + ts.get("overdue") + " 项任务逾期，优先清零：能今天闭环的不留到明天。";
        }
        if (!top3.isEmpty()) {
            return "聚焦「" + top3.get(0).title() + "」，P0/P1 不过夜；完成后记得留痕并同步进展。";
        }
        return "保持清单清零状态；如有新增任务，请第一时间录入并明确截止时间。";
    }
}
