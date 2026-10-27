package com.personal.dashboard.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.personal.dashboard.model.TalentBoard;
import com.personal.dashboard.model.TalentBoard.PersonNote;
import com.personal.dashboard.service.JsonDocService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 人才筛选 API：花名册 + 九宫格观察记录
 */
@RestController
@RequestMapping("/api/talent")
public class TalentController {

    private final JsonDocService docs;

    public TalentController(JsonDocService docs) {
        this.docs = docs;
    }

    private TalentBoard board() {
        return docs.load("talent", new TypeReference<>() {},
                () -> new TalentBoard(new LinkedHashMap<>(), new ArrayList<>()));
    }

    @GetMapping
    public TalentBoard get() {
        return board();
    }

    public record PersonRequest(String name, String roster, int performance,
                                int potential, String observation) {}

    @PostMapping("/people")
    public PersonNote add(@RequestBody PersonRequest req) {
        TalentBoard b = board();
        List<PersonNote> people = new ArrayList<>(b.people());
        PersonNote note = PersonNote.create(req.name(), req.roster(),
                Math.max(1, Math.min(3, req.performance())),
                Math.max(1, Math.min(3, req.potential())), req.observation());
        people.add(note);
        docs.save("talent", new TalentBoard(b.rosters(), people));
        return note;
    }

    @PutMapping("/people/{id}")
    public ResponseEntity<PersonNote> update(@PathVariable String id, @RequestBody PersonRequest req) {
        TalentBoard b = board();
        List<PersonNote> people = new ArrayList<>(b.people());
        for (int i = 0; i < people.size(); i++) {
            if (people.get(i).id().equals(id)) {
                PersonNote updated = new PersonNote(id, req.name(), req.roster(),
                        Math.max(1, Math.min(3, req.performance())),
                        Math.max(1, Math.min(3, req.potential())), req.observation(),
                        java.time.LocalDateTime.now().toString());
                people.set(i, updated);
                docs.save("talent", new TalentBoard(b.rosters(), people));
                return ResponseEntity.ok(updated);
            }
        }
        throw ApiException.notFound("人员记录不存在");
    }

    @DeleteMapping("/people/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable String id) {
        TalentBoard b = board();
        List<PersonNote> people = new ArrayList<>(b.people());
        boolean removed = people.removeIf(p -> p.id().equals(id));
        if (!removed) throw ApiException.notFound("人员记录不存在");
        docs.save("talent", new TalentBoard(b.rosters(), people));
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    // ==================== 花名册分组管理 ====================

    public record RosterRequest(String name) {}

    /** 新建花名册分组（如「实习生」） */
    @PostMapping("/rosters")
    public ResponseEntity<?> addRoster(@RequestBody RosterRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            throw ApiException.badRequest("名册名称不能为空");
        }
        String name = req.name().trim();
        if (name.length() > 20) {
            throw ApiException.badRequest("名册名称最长 20 字");
        }
        TalentBoard b = board();
        Map<String, List<TalentBoard.Member>> rosters = new LinkedHashMap<>(b.rosters());
        if (rosters.containsKey(name)) {
            throw ApiException.badRequest("名册「" + name + "」已存在");
        }
        rosters.put(name, new ArrayList<>());
        docs.save("talent", new TalentBoard(rosters, b.people()));
        return ResponseEntity.ok(rosters.keySet());
    }

    /** 删除花名册分组（连带删除组内成员的观察记录） */
    @DeleteMapping("/rosters/{roster}")
    public ResponseEntity<?> deleteRoster(@PathVariable String roster) {
        TalentBoard b = board();
        Map<String, List<TalentBoard.Member>> rosters = new LinkedHashMap<>(b.rosters());
        if (!rosters.containsKey(roster)) throw ApiException.notFound("花名册不存在");
        int memberCount = rosters.get(roster).size();
        rosters.remove(roster);
        List<PersonNote> people = new ArrayList<>(b.people());
        int before = people.size();
        people.removeIf(p -> p.roster().equals(roster));
        docs.save("talent", new TalentBoard(rosters, people));
        return ResponseEntity.ok(Map.of("deleted", true,
                "removedMembers", memberCount, "removedNotes", before - people.size()));
    }

    // ==================== 花名册成员管理 ====================

    public record MemberRequest(String name, String role) {}

    /** 添加成员到指定花名册 */
    @PostMapping("/rosters/{roster}/members")
    public ResponseEntity<?> addMember(@PathVariable String roster, @RequestBody MemberRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            throw ApiException.badRequest("姓名不能为空");
        }
        TalentBoard b = board();
        Map<String, List<TalentBoard.Member>> rosters = new LinkedHashMap<>(b.rosters());
        List<TalentBoard.Member> members = new ArrayList<>(rosters.getOrDefault(roster, List.of()));
        if (rosters.values().stream().flatMap(List::stream).anyMatch(m -> m.name().equals(req.name().trim()))) {
            throw ApiException.badRequest("该姓名已存在于花名册中");
        }
        members.add(new TalentBoard.Member(req.name().trim(),
                req.role() == null || req.role().isBlank() ? "成员" : req.role().trim()));
        rosters.put(roster, members);
        docs.save("talent", new TalentBoard(rosters, b.people()));
        return ResponseEntity.ok(rosters.get(roster));
    }

    /** 修改成员（可改名/改角色；改名时同步更新其观察记录） */
    @PutMapping("/rosters/{roster}/members/{name}")
    public ResponseEntity<?> updateMember(@PathVariable String roster, @PathVariable String name,
                                          @RequestBody MemberRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            throw ApiException.badRequest("姓名不能为空");
        }
        TalentBoard b = board();
        Map<String, List<TalentBoard.Member>> rosters = new LinkedHashMap<>(b.rosters());
        List<TalentBoard.Member> members = new ArrayList<>(rosters.getOrDefault(roster, List.of()));
        int idx = -1;
        for (int i = 0; i < members.size(); i++) {
            if (members.get(i).name().equals(name)) { idx = i; break; }
        }
        if (idx < 0) throw ApiException.notFound("成员不存在");
        String newName = req.name().trim();
        if (!newName.equals(name)
                && rosters.values().stream().flatMap(List::stream).anyMatch(m -> m.name().equals(newName))) {
            throw ApiException.badRequest("该姓名已存在于花名册中");
        }
        members.set(idx, new TalentBoard.Member(newName,
                req.role() == null || req.role().isBlank() ? members.get(idx).role() : req.role().trim()));
        rosters.put(roster, members);

        // 改名时同步观察记录中的人员姓名
        List<PersonNote> people = new ArrayList<>(b.people());
        if (!newName.equals(name)) {
            for (int i = 0; i < people.size(); i++) {
                PersonNote p = people.get(i);
                if (p.name().equals(name) && p.roster().equals(roster)) {
                    people.set(i, new PersonNote(p.id(), newName, p.roster(), p.performance(),
                            p.potential(), p.observation(), p.updatedAt()));
                }
            }
        }
        docs.save("talent", new TalentBoard(rosters, people));
        return ResponseEntity.ok(members.get(idx));
    }

    /** 删除成员（同时删除其九宫格观察记录） */
    @DeleteMapping("/rosters/{roster}/members/{name}")
    public ResponseEntity<?> deleteMember(@PathVariable String roster, @PathVariable String name) {
        TalentBoard b = board();
        Map<String, List<TalentBoard.Member>> rosters = new LinkedHashMap<>(b.rosters());
        List<TalentBoard.Member> members = new ArrayList<>(rosters.getOrDefault(roster, List.of()));
        boolean removed = members.removeIf(m -> m.name().equals(name));
        if (!removed) throw ApiException.notFound("成员不存在");
        rosters.put(roster, members);
        List<PersonNote> people = new ArrayList<>(b.people());
        int removedNotes = people.size();
        people.removeIf(p -> p.name().equals(name) && p.roster().equals(roster));
        removedNotes -= people.size();
        docs.save("talent", new TalentBoard(rosters, people));
        return ResponseEntity.ok(Map.of("deleted", true, "removedNotes", removedNotes));
    }
}
