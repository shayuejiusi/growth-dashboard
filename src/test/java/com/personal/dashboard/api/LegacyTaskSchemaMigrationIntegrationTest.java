package com.personal.dashboard.api;

import com.personal.dashboard.repo.TaskRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:legacy-task-schema;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.sql.init.mode=always",
        "spring.sql.init.schema-locations=classpath:legacy-task-schema.sql",
        "spring.jpa.hibernate.ddl-auto=update",
        "app.frontend-origins=http://localhost:5173",
        "app.cookie.secure=false"
})
class LegacyTaskSchemaMigrationIntegrationTest {

    @Autowired
    private TaskRepository taskRepository;

    @Test
    void existingRowsReceiveOrderingAndVersionDefaults() {
        var tasks = taskRepository.findAll();

        assertEquals(1, tasks.size());
        assertEquals(0, tasks.get(0).toRecord().position());
        assertEquals(0, tasks.get(0).toRecord().version());
    }
}
