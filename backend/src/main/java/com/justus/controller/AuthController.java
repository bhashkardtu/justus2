package com.justus.controller;

import com.justus.model.User;
import com.justus.repository.UserRepository;
import com.justus.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.Cookie;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    
    private static final Logger logger = Logger.getLogger(AuthController.class.getName());
    
    @Autowired
    private UserRepository userRepository;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String,String> body, HttpServletResponse response) {
        try {
            logger.info("Registration attempt for user: " + body.get("username"));
            
            long count = userRepository.count();
            logger.info("Current user count: " + count);
            
            if (count >= 2) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Registration closed: only two users allowed");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }
            
            String username = body.get("username");
            String password = body.get("password");
            
            if (username == null || username.trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Username is required");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }
            
            if (password == null || password.trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Password is required");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }

            if (userRepository.findByUsername(username.trim()).isPresent()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Username already exists");
                return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
            }

            User u = new User();
            u.setUsername(username.trim());
            u.setDisplayName(body.getOrDefault("displayName", username.trim()));
            u.setPasswordHash(encoder.encode(password));

            User saved = userRepository.save(u);
            logger.info("User registered successfully: " + saved.getUsername() + " with ID: " + saved.getId());
            
            String token = JwtUtil.generateToken(saved.getId(), saved.getUsername());

            // Set HTTP-only cookie for authentication
            Cookie authCookie = new Cookie("auth-token", token);
            authCookie.setHttpOnly(true);
            authCookie.setSecure(false); // Set to true in production with HTTPS
            authCookie.setPath("/");
            authCookie.setMaxAge(24 * 60 * 60); // 24 hours
            // Note: SameSite attribute will be handled by Spring Security CORS configuration
            response.addCookie(authCookie);

            Map<String,Object> res = new HashMap<>();
            res.put("token", token);
            res.put("user", Map.of("id", saved.getId(), "username", saved.getUsername(), "displayName", saved.getDisplayName()));
            return ResponseEntity.ok(res);
            
        } catch (Exception e) {
            logger.severe("Registration error: " + e.getMessage());
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("message", "Registration failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String,String> body, HttpServletResponse response) {
        try {
            logger.info("Login attempt for user: " + body.get("username"));
            
            String username = body.get("username");
            String password = body.get("password");
            
            if (username == null || username.trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Username is required");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }
            
            if (password == null || password.trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Password is required");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }

            User found = userRepository.findByUsername(username.trim()).orElse(null);
            if (found == null || !encoder.matches(password, found.getPasswordHash())) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Invalid username or password");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
            }

            String token = JwtUtil.generateToken(found.getId(), found.getUsername());

            // Set HTTP-only cookie for authentication
            Cookie authCookie = new Cookie("auth-token", token);
            authCookie.setHttpOnly(true);
            authCookie.setSecure(false); // Set to true in production with HTTPS
            authCookie.setPath("/");
            authCookie.setMaxAge(24 * 60 * 60); // 24 hours
            // Note: SameSite attribute will be handled by Spring Security CORS configuration
            response.addCookie(authCookie);

            Map<String,Object> res = new HashMap<>();
            res.put("token", token);
            res.put("user", Map.of("id", found.getId(), "username", found.getUsername(), "displayName", found.getDisplayName()));
            return ResponseEntity.ok(res);
            
        } catch (Exception e) {
            logger.severe("Login error: " + e.getMessage());
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("message", "Login failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        try {
            // Clear the auth cookie
            Cookie authCookie = new Cookie("auth-token", "");
            authCookie.setHttpOnly(true);
            authCookie.setSecure(false); // Set to true in production with HTTPS
            authCookie.setPath("/");
            authCookie.setMaxAge(0); // Expire immediately
            // Note: SameSite attribute will be handled by Spring Security CORS configuration
            response.addCookie(authCookie);

            Map<String, String> res = new HashMap<>();
            res.put("message", "Logged out successfully");
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            logger.severe("Logout error: " + e.getMessage());
            Map<String, String> error = new HashMap<>();
            error.put("message", "Logout failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    @GetMapping("/users")
    public ResponseEntity<?> getUsers() {
        try {
            List<User> users = userRepository.findAll();
            List<Map<String, String>> userList = users.stream()
                .map(user -> Map.of(
                    "id", user.getId(),
                    "username", user.getUsername(),
                    "displayName", user.getDisplayName()
                ))
                .collect(Collectors.toList());
            return ResponseEntity.ok(userList);
        } catch (Exception e) {
            logger.severe("Get users error: " + e.getMessage());
            Map<String, String> error = new HashMap<>();
            error.put("message", "Failed to get users: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
