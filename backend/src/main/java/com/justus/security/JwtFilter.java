package com.justus.security;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.Cookie;
import java.io.IOException;
import java.util.Collections;

public class JwtFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        String method = request.getMethod();
        
        System.out.println("JwtFilter processing request: " + method + " " + path);
        
        // Skip JWT filter for OPTIONS requests (CORS preflight)
        if (request.getMethod().equals("OPTIONS")) {
            System.out.println("Skipping JWT filter for OPTIONS request");
            filterChain.doFilter(request, response);
            return;
        }
        
        String token = null;
        
        // First, try to get token from Authorization header
        String header = request.getHeader("Authorization");
        System.out.println("Authorization header: " + (header != null ? "present" : "missing"));
        
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            token = header.substring(7);
            System.out.println("Token found in Authorization header");
        } else {
            // If no Authorization header, try to get token from cookie
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("auth-token".equals(cookie.getName())) {
                        token = cookie.getValue();
                        System.out.println("Token found in auth-token cookie");
                        break;
                    }
                }
            }
            if (token == null) {
                System.out.println("No token found in Authorization header or cookies");
            }
        }
        
        if (StringUtils.hasText(token)) {
            try {
                String userId = JwtUtil.parseUserId(token);
                System.out.println("JWT validated successfully for user: " + userId);
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                // invalid token — let downstream handle unauthorized
                System.out.println("JWT validation error: " + e.getMessage());
            }
        }
        filterChain.doFilter(request, response);
    }
}
