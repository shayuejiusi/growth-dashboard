package com.personal.dashboard.repo;

import com.personal.dashboard.entity.JsonDocument;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JsonDocumentRepository extends JpaRepository<JsonDocument, String> {
}
