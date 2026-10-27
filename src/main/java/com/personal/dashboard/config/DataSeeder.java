package com.personal.dashboard.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.personal.dashboard.entity.CapabilityEntity;
import com.personal.dashboard.entity.UserEntity;
import com.personal.dashboard.model.CapabilityDimension;
import com.personal.dashboard.model.User;
import com.personal.dashboard.repo.CapabilityRepository;
import com.personal.dashboard.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 首次启动播种：数据库为空时从 classpath seed/ 初始化用户与能力维度。
 * 之后以数据库为准，种子不再生效。
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository userRepo;
    private final CapabilityRepository capabilityRepo;
    private final com.personal.dashboard.repo.TaskRepository taskRepo;
    private final ObjectMapper mapper;

    public DataSeeder(UserRepository userRepo, CapabilityRepository capabilityRepo,
                      com.personal.dashboard.repo.TaskRepository taskRepo, ObjectMapper mapper) {
        this.userRepo = userRepo;
        this.capabilityRepo = capabilityRepo;
        this.taskRepo = taskRepo;
        this.mapper = mapper;
    }

    @Override
    public void run(String... args) throws Exception {
        // 历史数据迁移：多用户隔离改造前的任务没有归属人，统一划给 admin
        var orphanTasks = taskRepo.findByOwnerIsNull();
        if (!orphanTasks.isEmpty()) {
            orphanTasks.forEach(t -> t.setOwner("admin"));
            taskRepo.saveAll(orphanTasks);
            log.info("已将 {} 条历史任务归属到 admin", orphanTasks.size());
        }
        if (userRepo.count() == 0) {
            List<User> users = mapper.readValue(
                    new ClassPathResource("seed/users.json").getInputStream(), new TypeReference<>() {});
            userRepo.saveAll(users.stream().map(UserEntity::from).toList());
            log.info("已播种 {} 个初始用户", users.size());
        }
        if (capabilityRepo.count() == 0) {
            List<CapabilityDimension> dims = mapper.readValue(
                    new ClassPathResource("seed/capabilities.json").getInputStream(), new TypeReference<>() {});
            List<CapabilityEntity> entities = new java.util.ArrayList<>();
            for (int i = 0; i < dims.size(); i++) {
                entities.add(CapabilityEntity.from(dims.get(i), i));
            }
            capabilityRepo.saveAll(entities);
            log.info("已播种 {} 个能力维度", dims.size());
        }
    }
}
