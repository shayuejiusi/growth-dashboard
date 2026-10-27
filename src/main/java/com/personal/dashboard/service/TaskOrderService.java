package com.personal.dashboard.service;

import com.personal.dashboard.entity.TaskEntity;
import com.personal.dashboard.model.TaskItem;
import com.personal.dashboard.repo.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.IntStream;

import static java.util.stream.Collectors.toMap;

@Service
public class TaskOrderService {

    private final TaskRepository repo;

    public TaskOrderService(TaskRepository repo) {
        this.repo = repo;
    }

    public record OrderItem(String id, long version) {}

    @Transactional
    public List<TaskItem> reorder(String owner, List<OrderItem> requested) {
        List<TaskEntity> current = repo.findByOwnerForUpdate(owner);
        validateExactIdsAndVersions(current, requested);
        Map<String, Integer> positions = IntStream.range(0, requested.size()).boxed()
                .collect(toMap(i -> requested.get(i).id(), i -> i));
        current.forEach(e -> e.setPosition(positions.get(e.getId())));
        return repo.saveAllAndFlush(current).stream()
                .sorted(Comparator.comparingInt(e -> positions.get(e.getId())))
                .map(TaskEntity::toRecord).toList();
    }

    private static void validateExactIdsAndVersions(
            List<TaskEntity> current, List<OrderItem> requested) {
        Map<String, TaskEntity> byId = current.stream()
                .collect(toMap(TaskEntity::getId, Function.identity()));
        Set<String> unique = new HashSet<>();
        if (requested == null || current.size() != requested.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "排序必须包含全部任务");
        }
        for (OrderItem item : requested) {
            if (item == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "任务 ID 缺失、重复或无权访问");
            }
            TaskEntity entity = byId.get(item.id());
            if (entity == null || !unique.add(item.id())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "任务 ID 缺失、重复或无权访问");
            }
            if (entity.getVersion() != item.version()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "任务已被其他操作更新");
            }
        }
    }
}
