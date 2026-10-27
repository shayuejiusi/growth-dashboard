package com.personal.dashboard.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * AI 服务配置（application.properties 中以 ai. 开头的配置项）
 */
@Component
@ConfigurationProperties(prefix = "ai")
public class AiProperties {

    /** local 或 openai-compatible */
    private String provider = "openai-compatible";
    /** OpenAI 兼容服务的 base url，如 https://api.openai.com/v1 */
    private String baseUrl = "https://api.openai.com/v1";
    /** API Key，为空时自动回退 local 规则引擎 */
    private String apiKey = "";
    /** 模型名称 */
    private String model = "gpt-4o-mini";
    /** 请求超时（秒） */
    private int timeoutSeconds = 60;

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }

    public boolean remoteEnabled() {
        return "openai-compatible".equalsIgnoreCase(provider)
                && apiKey != null && !apiKey.isBlank();
    }
}
