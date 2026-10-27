package com.personal.dashboard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.personal.dashboard.entity.JsonDocument;
import com.personal.dashboard.repo.JsonDocumentRepository;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.function.Supplier;

/**
 * 文档型数据存取（每日精选 / 日复盘 / 人才看板 / 评估结果）。
 * 数据存于数据库 json_documents 表；首次读取时若不存在，从 classpath seed/ 载入种子数据。
 */
@Service
public class JsonDocService {

    private final JsonDocumentRepository repo;
    private final ObjectMapper mapper;

    public JsonDocService(JsonDocumentRepository repo, ObjectMapper mapper) {
        this.repo = repo;
        this.mapper = mapper;
    }

    /**
     * 读取文档。key 对应种子文件 seed/{key}.json（如 key="talent" → seed/talent.json）。
     */
    @Transactional
    public <T> T load(String key, TypeReference<T> type, Supplier<T> fallback) {
        return repo.findById(key).map(doc -> read(doc.getContent(), type))
                .orElseGet(() -> {
                    T seed = readSeed(key, type);
                    if (seed != null) {
                        save(key, seed);
                        return seed;
                    }
                    T value = fallback.get();
                    if (value != null) save(key, value);
                    return value;
                });
    }

    @Transactional
    public void save(String key, Object value) {
        try {
            String json = mapper.writeValueAsString(value);
            JsonDocument doc = repo.findById(key).orElse(new JsonDocument(key, json));
            doc.setContent(json);
            repo.save(doc);
        } catch (IOException e) {
            throw new UncheckedIOException("保存文档失败: " + key, e);
        }
    }

    public boolean exists(String key) {
        return repo.existsById(key);
    }

    private <T> T read(String json, TypeReference<T> type) {
        try {
            return mapper.readValue(json, type);
        } catch (IOException e) {
            throw new UncheckedIOException("解析文档失败", e);
        }
    }

    private <T> T readSeed(String key, TypeReference<T> type) {
        try {
            ClassPathResource seed = new ClassPathResource("seed/" + key + ".json");
            return seed.exists() ? mapper.readValue(seed.getInputStream(), type) : null;
        } catch (IOException e) {
            throw new UncheckedIOException("加载种子数据失败: " + key, e);
        }
    }
}
