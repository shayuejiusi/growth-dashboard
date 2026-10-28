package com.personal.dashboard.entity;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.personal.dashboard.model.TaskItem;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "tasks")
public class TaskEntity {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Id
    private String id;

    /** 归属用户（数据按登录用户隔离） */
    @Column(name = "owner")
    private String owner;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskItem.Priority priority;

    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskItem.Status status;

    @Column(nullable = false)
    private boolean needReport;

    /** 关联能力维度，JSON 数组字符串存储 */
    @Lob
    @Column(columnDefinition = "CLOB")
    private String capabilitiesJson = "[]";

    @Column(length = 2000)
    private String note;

    private LocalDateTime createdAt;
    private LocalDateTime completedAt;

    // ---- 扩展字段（新增任务完整表单） ----
    @Column(length = 50)
    private String category;

    @Column(length = 200)
    private String source;

    @Column(length = 500)
    private String nextStep;

    @Column(length = 500)
    private String expectedOutcome;

    @Column(length = 500)
    private String blocker;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TaskItem.RepeatType repeatType = TaskItem.RepeatType.NONE;

    @Column(nullable = false, columnDefinition = "INTEGER DEFAULT 0 NOT NULL")
    private int position = 0;

    @Version
    @Column(nullable = false, columnDefinition = "BIGINT DEFAULT 0 NOT NULL")
    private long version = 0;

    protected TaskEntity() {}

    public static TaskEntity from(TaskItem t) {
        return from(t, null);
    }

    public static TaskEntity from(TaskItem t, String owner) {
        TaskEntity e = new TaskEntity();
        e.id = t.id();
        e.owner = owner;
        e.title = t.title();
        e.priority = t.priority();
        e.dueDate = t.dueDate();
        e.status = t.status();
        e.needReport = t.needReport();
        e.capabilitiesJson = writeCaps(t.capabilities());
        e.note = t.note();
        e.createdAt = t.createdAt();
        e.completedAt = t.completedAt();
        e.category = t.category();
        e.source = t.source();
        e.nextStep = t.nextStep();
        e.expectedOutcome = t.expectedOutcome();
        e.blocker = t.blocker();
        e.repeatType = t.repeatType() == null ? TaskItem.RepeatType.NONE : t.repeatType();
        e.position = t.position() == null ? 0 : t.position();
        e.version = t.version() == null ? 0 : t.version();
        return e;
    }

    public TaskItem toRecord() {
        return new TaskItem(id, title, priority, dueDate, status, needReport,
                readCaps(capabilitiesJson), note, createdAt, completedAt,
                category, source, nextStep, expectedOutcome, blocker,
                repeatType == null ? TaskItem.RepeatType.NONE : repeatType,
                position, version);
    }

    private static String writeCaps(List<String> caps) {
        try {
            return MAPPER.writeValueAsString(caps == null ? List.of() : caps);
        } catch (Exception e) {
            return "[]";
        }
    }

    private static List<String> readCaps(String json) {
        try {
            return json == null ? List.of() : MAPPER.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    public String getId() { return id; }
    public String getOwner() { return owner; }
    public long getVersion() { return version; }
    public void setOwner(String owner) { this.owner = owner; }
    public void setPosition(int position) { this.position = position; }
}
