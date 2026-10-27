package com.personal.dashboard.entity;

import com.personal.dashboard.model.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    private String username;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private int level;

    @Column(nullable = false)
    private String salt;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String assessmentStatus;

    protected UserEntity() {}

    public UserEntity(String username, String name, int level, String salt,
                      String passwordHash, String assessmentStatus) {
        this.username = username;
        this.name = name;
        this.level = level;
        this.salt = salt;
        this.passwordHash = passwordHash;
        this.assessmentStatus = assessmentStatus;
    }

    public static UserEntity from(User u) {
        return new UserEntity(u.username(), u.name(), u.level(), u.salt(), u.passwordHash(), u.assessmentStatus());
    }

    public User toRecord() {
        return new User(username, name, level, salt, passwordHash, assessmentStatus);
    }

    public String getUsername() { return username; }
    public String getName() { return name; }
    public int getLevel() { return level; }
    public String getSalt() { return salt; }
    public String getPasswordHash() { return passwordHash; }
    public String getAssessmentStatus() { return assessmentStatus; }
    public void setName(String name) { this.name = name; }
    public void setLevel(int level) { this.level = level; }
    public void setSalt(String salt) { this.salt = salt; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public void setAssessmentStatus(String assessmentStatus) { this.assessmentStatus = assessmentStatus; }
}
