package com.justus.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

import java.security.Key;
import java.util.Date;
import java.nio.charset.StandardCharsets;

public class JwtUtil {
    // Using a fixed secret key string instead of generating a random key each time
    private static final String SECRET_KEY = "justus-secure-key-for-jwt-token-signature-validation-2025";
    private static final Key key = Keys.hmacShaKeyFor(SECRET_KEY.getBytes(StandardCharsets.UTF_8));
    private static final long EXP_MS = 1000L * 60 * 60 * 24; // 24h

    public static String generateToken(String userId, String username) {
        return Jwts.builder()
                .setSubject(userId)
                .claim("username", username)
                .setExpiration(new Date(System.currentTimeMillis() + EXP_MS))
                .signWith(key)
                .compact();
    }

    public static String parseUserId(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build()
                .parseClaimsJws(token).getBody().getSubject();
    }
    
    // Additional method for direct extraction of username (subject) from token
    public static String extractUsername(String token) {
        try {
            return Jwts.parserBuilder().setSigningKey(key).build()
                .parseClaimsJws(token).getBody().getSubject();
        } catch (Exception e) {
            return null;
        }
    }
}
