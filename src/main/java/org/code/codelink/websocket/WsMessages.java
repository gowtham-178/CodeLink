package org.code.codelink.websocket;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

public class WsMessages {

    // ── Inbound: client → /app/room/{roomId}/edit ─────────────────────────
    @Getter
    @NoArgsConstructor
    public static class CodeEdit {
        private String code;
        private String senderSession;
    }

    // ── Outbound: server → /topic/room/{roomId} ───────────────────────────
    @Getter
    @AllArgsConstructor
    public static class CodeBroadcast {
        private String code;
        private int viewerCount;
        private String senderSession;
    }

    // ── Outbound: viewer count only (on connect/disconnect) ───────────────
    @Getter
    @AllArgsConstructor
    public static class ViewerCount {
        private int viewerCount;
    }
}
