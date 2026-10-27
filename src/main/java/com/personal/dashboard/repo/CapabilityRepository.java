package com.personal.dashboard.repo;

import com.personal.dashboard.entity.CapabilityEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CapabilityRepository extends JpaRepository<CapabilityEntity, String> {

    List<CapabilityEntity> findAllByOrderByDisplayOrderAsc();
}
