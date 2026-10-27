package com.personal.dashboard.service;

import com.personal.dashboard.entity.CapabilityEntity;
import com.personal.dashboard.model.CapabilityDimension;
import com.personal.dashboard.repo.CapabilityRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 能力维度数据读取（能力地图 / 每日精选短板匹配 / 评估回写共用）
 */
@Service
public class CapabilityService {

    private final CapabilityRepository repo;

    public CapabilityService(CapabilityRepository repo) {
        this.repo = repo;
    }

    public List<CapabilityDimension> all() {
        return repo.findAllByOrderByDisplayOrderAsc().stream().map(CapabilityEntity::toRecord).toList();
    }

    /** 回写某维度的评分与评估依据 */
    public void updateAssessment(String name, int score, String reasoning, String evidence) {
        repo.findById(name).ifPresent(e -> {
            e.setScore(Math.max(1, Math.min(5, score)));
            e.setReasoning(reasoning);
            e.setEvidence(evidence);
            repo.save(e);
        });
    }
}
