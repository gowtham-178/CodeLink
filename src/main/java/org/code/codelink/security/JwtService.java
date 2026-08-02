package org.code.codelink.security;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey key;
    private final long expiryMs;

    public JwtService(
            @Value("${codelink.jwt.secret}") String secret,
            @Value("${codelink.jwt.expiry-ms:604800000}") long expiryMs) {
        // Pad/trim to exactly 32 bytes for HS256
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        byte[] keyBytes = new byte[32];
        System.arraycopy(bytes, 0, keyBytes, 0, Math.min(bytes.length, 32));
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.expiryMs = expiryMs;
    }

    public String generate(String username) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(username)
                .issuedAt(new Date(now))
                .expiration(new Date(now + expiryMs))
                .signWith(key)
                .compact();
    }

    /** Returns the username, or throws JwtException if the token is invalid/expired. */
    public String extractUsername(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    public boolean isValid(String token) {
        try {
            extractUsername(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
