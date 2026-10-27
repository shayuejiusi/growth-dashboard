package com.personal.dashboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 个人工作与能力提升看板
 * Personal Work & Capability Growth Dashboard
 *
 * 技术栈：Java 17 (LTS) + Spring Boot 3.x + REST API + 可插拔 AI 接口层
 */
@SpringBootApplication
public class DashboardApplication {

    public static void main(String[] args) {
        SpringApplication.run(DashboardApplication.class, args);
    }
}
