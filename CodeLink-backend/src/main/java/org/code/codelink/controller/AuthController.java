package org.code.codelink.controller;

import lombok.RequiredArgsConstructor;
import org.code.codelink.dto.AuthResponse;
import org.code.codelink.dto.LoginRequest;
import org.code.codelink.dto.RegisterRequest;
import org.code.codelink.model.User;
import org.code.codelink.repository.UserRepository;
import org.code.codelink.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    // ── POST /api/auth/register ───────────────────────────────────────────────
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@RequestBody RegisterRequest req) {
        if (req.getUsername() == null || req.getUsername().isBlank())
            throw new IllegalArgumentException("username is required");
        if (req.getPassword() == null || req.getPassword().length() < 6)
            throw new IllegalArgumentException("password must be at least 6 characters");

        String username = req.getUsername().trim().toLowerCase();

        if (userRepository.existsByUsername(username))
            throw new IllegalArgumentException("username already taken");

        User user = userRepository.save(new User(username, passwordEncoder.encode(req.getPassword())));
        String token = jwtService.generate(user.getUsername());
        return new AuthResponse(token, user.getUsername());
    }

    // ── POST /api/auth/login ──────────────────────────────────────────────────
    @PostMapping("/login")
    public AuthResponse login(@RequestBody LoginRequest req) {
        if (req.getUsername() == null || req.getPassword() == null)
            throw new IllegalArgumentException("username and password are required");

        String username = req.getUsername().trim().toLowerCase();

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash()))
            throw new IllegalArgumentException("Invalid credentials");

        String token = jwtService.generate(user.getUsername());
        return new AuthResponse(token, user.getUsername());
    }
}
