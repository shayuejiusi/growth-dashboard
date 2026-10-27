package com.personal.dashboard.entity;

import com.personal.dashboard.model.CapabilityDimension;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "capabilities")
public class CapabilityEntity {

    @Id
    private String name;

    @Column(nullable = false)
    private int score;

    @Column(nullable = false)
    private int target;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String reasoning;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String evidence;

    /** 列表展示顺序 */
    @Column(nullable = false)
    private int displayOrder;

    protected CapabilityEntity() {}

    public CapabilityEntity(String name, int score, int target, String reasoning, String evidence, int displayOrder) {
        this.name = name;
        this.score = score;
        this.target = target;
        this.reasoning = reasoning;
        this.evidence = evidence;
        this.displayOrder = displayOrder;
    }

    public static CapabilityEntity from(CapabilityDimension d, int order) {
        return new CapabilityEntity(d.name(), d.score(), d.target(), d.reasoning(), d.evidence(), order);
    }

    public CapabilityDimension toRecord() {
        return new CapabilityDimension(name, score, target, reasoning, evidence);
    }

    public String getName() { return name; }
    public int getScore() { return score; }
    public int getTarget() { return target; }
    public String getReasoning() { return reasoning; }
    public String getEvidence() { return evidence; }
    public int getDisplayOrder() { return displayOrder; }
    public void setScore(int score) { this.score = score; }
    public void setTarget(int target) { this.target = target; }
    public void setReasoning(String reasoning) { this.reasoning = reasoning; }
    public void setEvidence(String evidence) { this.evidence = evidence; }
}
