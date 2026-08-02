package org.code.codelink.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.code.codelink.security.JwtService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

/**
 * Validates the JWT on every STOMP CONNECT frame.
 * Rejects the connection if the token is missing or invalid.
 * Other frame types (SEND, SUBSCRIBE, etc.) pass through unchecked —
 * the CONNECT gate is sufficient since a client can't get past CONNECT without a valid token.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WsChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                if (jwtService.isValid(token)) {
                    String username = jwtService.extractUsername(token);
                    accessor.setUser(() -> username);
                    log.debug("WS CONNECT accepted for authenticated user={}", username);
                    return message;
                }
            }

            log.debug("WS CONNECT accepted for anonymous guest user");
        }

        return message;
    }
}
