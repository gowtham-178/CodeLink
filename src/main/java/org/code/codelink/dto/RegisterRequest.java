package org.code.codelink.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter @NoArgsConstructor
public class RegisterRequest {
    private String username;
    private String password;
}
