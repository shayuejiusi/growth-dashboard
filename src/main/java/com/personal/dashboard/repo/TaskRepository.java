package com.personal.dashboard.repo;

import com.personal.dashboard.entity.TaskEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<TaskEntity, String> {

    List<TaskEntity> findByOwnerOrderByPositionAscCreatedAtAsc(String owner);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TaskEntity t where t.owner = :owner")
    List<TaskEntity> findByOwnerForUpdate(@Param("owner") String owner);

    Optional<TaskEntity> findByIdAndOwner(String id, String owner);

    /** 历史数据迁移用：归属人为空的旧任务 */
    List<TaskEntity> findByOwnerIsNull();
}
