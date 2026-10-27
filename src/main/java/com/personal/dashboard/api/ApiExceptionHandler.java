package com.personal.dashboard.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.servlet.NoHandlerFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> business(ApiException ex, HttpServletRequest req) {
        return response(ex.status(), ex.code(), ex.getMessage(), req);
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class,
            ConstraintViolationException.class, HttpMessageNotReadableException.class,
            MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class,
            IllegalArgumentException.class})
    public ResponseEntity<ApiError> badRequest(Exception ex, HttpServletRequest req) {
        return response(HttpStatus.BAD_REQUEST, "BAD_REQUEST", badRequestMessage(ex), req);
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ApiError> notFound(Exception ex, HttpServletRequest req) {
        return response(HttpStatus.NOT_FOUND, "NOT_FOUND", "请求的资源不存在", req);
    }

    /** 保留框架或控制器显式声明的 401、403、404 等 HTTP 状态。 */
    @ExceptionHandler(ErrorResponseException.class)
    public ResponseEntity<ApiError> httpError(ErrorResponseException ex, HttpServletRequest req) {
        HttpStatusCode status = ex.getStatusCode();
        String code = switch (status.value()) {
            case 400 -> "BAD_REQUEST";
            case 401 -> "UNAUTHORIZED";
            case 403 -> "FORBIDDEN";
            case 404 -> "NOT_FOUND";
            default -> "HTTP_ERROR";
        };
        HttpStatus resolved = HttpStatus.resolve(status.value());
        String message = resolved == null ? "请求失败" : resolved.getReasonPhrase();
        return ResponseEntity.status(status).body(ApiError.of(status.value(), code, message, req.getRequestURI()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception ex, HttpServletRequest req) {
        ApiError error = ApiError.of(500, "INTERNAL_ERROR", "服务器内部错误", req.getRequestURI());
        log.error("Unhandled API exception, requestId={}", error.requestId(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }

    private ResponseEntity<ApiError> response(HttpStatus status, String code, String message,
                                               HttpServletRequest req) {
        return ResponseEntity.status(status)
                .body(ApiError.of(status.value(), code, message, req.getRequestURI()));
    }

    private String badRequestMessage(Exception ex) {
        if (ex instanceof MethodArgumentNotValidException validation) {
            return validation.getBindingResult().getFieldErrors().stream()
                    .findFirst().map(error -> error.getField() + ": " + error.getDefaultMessage())
                    .orElse("请求参数校验失败");
        }
        if (ex instanceof BindException binding) {
            return binding.getBindingResult().getFieldErrors().stream()
                    .findFirst().map(error -> error.getField() + ": " + error.getDefaultMessage())
                    .orElse("请求参数校验失败");
        }
        if (ex instanceof IllegalArgumentException illegal
                && illegal.getMessage() != null && !illegal.getMessage().isBlank()) {
            return illegal.getMessage();
        }
        return "请求参数格式错误";
    }
}
