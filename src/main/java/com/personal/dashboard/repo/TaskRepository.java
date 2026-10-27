package com.personal.dashboard.repo;

import com.personal.dashboard.entity.TaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<TaskEntity, String> {

    List<TaskEntity> findByOwner(String owner);

    Optional<TaskEntity> findByIdAndOwner(String id, String owner);

    /** 历史数据迁移用：归属人为空的旧任务 */
    List<TaskEntity> findByOwnerIsNull();
}
