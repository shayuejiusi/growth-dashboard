package com.personal.dashboard.ai;

import com.personal.dashboard.ai.AiService.TaskDraft;
import com.personal.dashboard.ai.OpenAiCompatibleAiService.AiCallException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AiGatewayTest {

    private final OpenAiCompatibleAiService remote = mock(OpenAiCompatibleAiService.class);
    private final LocalHeuristicAiService local = mock(LocalHeuristicAiService.class);
    private final AiGateway gateway = new AiGateway(remote, local);

    @Test
    void configuredRemoteFailureIsNotMislabeledAsAiResult() {
        when(remote.isConfigured()).thenReturn(true);
        when(remote.extractTasks("正文", "doc")).thenThrow(new AiCallException("上游失败"));

        assertThrows(AiCallException.class, () -> gateway.extractTasks("正文", "doc", "ai"));
        verify(local, never()).extractTasks(anyString(), anyString());
    }

    @Test
    void localModeNeverCallsRemote() {
        List<TaskDraft> expected = List.of(new TaskDraft("任务", "P2", null, false, List.of()));
        when(local.extractTasks("正文", "doc")).thenReturn(expected);

        assertEquals(expected, gateway.extractTasks("正文", "doc", "local"));
        verifyNoInteractions(remote);
    }

    @Test
    void unconfiguredRemoteRequiresExplicitLocalMode() {
        when(remote.isConfigured()).thenReturn(false);

        AiCallException error = assertThrows(AiCallException.class,
                () -> gateway.extractTasks("正文", "doc", "ai"));
        assertEquals("AI 尚未配置，请配置服务端 API Key 或使用本地快速识别", error.getMessage());
        verify(remote, never()).extractTasks(anyString(), anyString());
        verify(local, never()).extractTasks(anyString(), anyString());
    }
}
