package com.personal.dashboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

/**
 * 文档型数据的通用存储（每日精选 / 日复盘 / 人才看板 / 评估结果），
 * 以 JSON 字符串形式存一整份文档。
 */
@Entity
@Table(name = "json_documents")
public class JsonDocument {

    @Id
    private String docKey;

    @Lob
    @Column(columnDefinition = "CLOB", nullable = false)
    private String content;

    protected JsonDocument() {}

    public JsonDocument(String docKey, String content) {
        this.docKey = docKey;
        this.content = content;
    }

    public String getDocKey() { return docKey; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
