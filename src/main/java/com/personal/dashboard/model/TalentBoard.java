package com.personal.dashboard.model;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 人才筛选看板：花名册 + 九宫格观察记录
 */
public record TalentBoard(
        Map<String, List<Member>> rosters,
        List<PersonNote> people
) {
    public record Member(String name, String role) {}

    /**
     * 人才观察记录：绩效(performance) 与潜力(potential) 各 1-3 分，构成九宫格
     */
    public record PersonNote(
            String id,
            String name,
            String roster,
            int performance,
            int potential,
            String observation,
            String updatedAt
    ) {
        public static PersonNote create(String name, String roster, int performance,
                                        int potential, String observation) {
            return new PersonNote(UUID.randomUUID().toString(), name, roster,
                    performance, potential, observation, java.time.LocalDateTime.now().toString());
        }
    }
}
