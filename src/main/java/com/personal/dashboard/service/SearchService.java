package com.personal.dashboard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.personal.dashboard.model.DailyContent;
import com.personal.dashboard.model.SearchResult;
import com.personal.dashboard.model.TalentBoard;
import com.personal.dashboard.model.User;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

/** 按当前用户和权限等级搜索任务、人才与每日精选。 */
@Service
public class SearchService {

    private final StatsService stats;
    private final JsonDocService docs;

    public SearchService(StatsService stats, JsonDocService docs) {
        this.stats = stats;
        this.docs = docs;
    }

    public SearchResponse search(User user, String query) {
        String normalized = query.trim().toLowerCase(Locale.ROOT);
        boolean includePeople = user.level() == 1;
        boolean includeContent = user.level() <= 2;
        return new SearchResponse(
                limit(searchTasks(user.username(), normalized)),
                includePeople ? limit(searchPeople(normalized)) : List.of(),
                includeContent ? limit(searchContent(normalized)) : List.of());
    }

    private Stream<SearchResult> searchTasks(String username, String query) {
        return stats.tasks(username).stream()
                .filter(task -> matches(query, task.title(), task.source()))
                .map(task -> new SearchResult("task", task.id(), task.title(),
                        value(task.source()), "/tasks?focus=" + task.id()));
    }

    private Stream<SearchResult> searchPeople(String query) {
        TalentBoard board = docs.load("talent", new TypeReference<>() {},
                () -> new TalentBoard(Map.of(), List.of()));
        return board.people().stream()
                .filter(person -> matches(query, person.name()))
                .map(person -> new SearchResult("person", person.id(), person.name(),
                        value(person.roster()), "/talent?person=" + person.id()));
    }

    private Stream<SearchResult> searchContent(String query) {
        DailyContent content = docs.load("content", new TypeReference<>() {},
                () -> new DailyContent(null, List.of(), List.of(), List.of(), null));
        return content.articles().stream()
                .filter(item -> matches(query, item.title(), item.source()))
                .map(item -> new SearchResult("content", item.title(), item.title(),
                        value(item.source()), "/content?item="
                        + URLEncoder.encode(item.title(), StandardCharsets.UTF_8)));
    }

    private static boolean matches(String query, String... values) {
        return Arrays.stream(values)
                .filter(Objects::nonNull)
                .map(value -> value.toLowerCase(Locale.ROOT))
                .anyMatch(value -> value.contains(query));
    }

    private static String value(String value) {
        return value == null ? "" : value;
    }

    private static <T> List<T> limit(Stream<T> stream) {
        return stream.limit(5).toList();
    }

    public record SearchResponse(List<SearchResult> tasks,
                                 List<SearchResult> people,
                                 List<SearchResult> content) {}
}
