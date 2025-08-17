package com.justus.security;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.security.Principal;
import java.util.Map;

public class HandshakeAuthInterceptor implements HandshakeInterceptor {
    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {
        // try header first
        String auth = request.getHeaders().getFirst("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                String userId = JwtUtil.parseUserId(auth.substring(7));
                attributes.put("user", new StompPrincipal(userId));
                return true;
            } catch (Exception e) { }
        }
        // try query param token
        java.net.URI uri = request.getURI();
        String query = uri.getQuery();
        if (query != null) {
            for (String part : query.split("&")) {
                if (part.startsWith("token=")) {
                    String token = part.substring(6);
                    try {
                        String userId = JwtUtil.parseUserId(token);
                        attributes.put("user", new StompPrincipal(userId));
                        return true;
                    } catch (Exception e) {}
                }
            }
        }
        return true; // allow anonymous if no token
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) { }

    static class StompPrincipal implements Principal {
        private final String name;
        StompPrincipal(String name){ this.name = name; }
        @Override public String getName(){ return name; }
    }
}
