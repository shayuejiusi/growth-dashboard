package com.personal.dashboard.service;

import com.personal.dashboard.model.AssessmentQuestion;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 进行中的评估试卷缓存（用户名 → 题目），
 * 供评估控制器与管理员恢复评估资格时共用。
 */
@Component
public class AssessmentPaperStore {

    private final Map<String, List<AssessmentQuestion>> papers = new ConcurrentHashMap<>();

    public List<AssessmentQuestion> get(String username) {
        return papers.get(username);
    }

    public List<AssessmentQuestion> computeIfAbsent(String username,
                                                    java.util.function.Supplier<List<AssessmentQuestion>> supplier) {
        return papers.computeIfAbsent(username, k -> supplier.get());
    }

    public void remove(String username) {
        papers.remove(username);
    }
}
