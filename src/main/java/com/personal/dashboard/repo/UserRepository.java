package com.personal.dashboard.repo;

import com.personal.dashboard.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, String> {

    long countByLevel(int level);
}
