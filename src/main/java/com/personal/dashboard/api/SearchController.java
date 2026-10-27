package com.personal.dashboard.api;

import com.personal.dashboard.model.User;
import com.personal.dashboard.service.SearchService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 权限感知的全局搜索 API。 */
@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService search;

    public SearchController(SearchService search) {
        this.search = search;
    }

    @GetMapping
    public SearchService.SearchResponse search(@RequestParam String q,
                                               @RequestAttribute("currentUser") User currentUser) {
        String query = q.trim();
        if (query.length() < 1 || query.length() > 50) {
            throw ApiException.badRequest("搜索关键词长度须为 1 至 50 个字符");
        }
        return search.search(currentUser, query);
    }
}
