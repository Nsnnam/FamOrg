# Căn cứ cập nhật AI — 2026-08-13

## Google Gemini API
Nguồn chính thức: https://ai.google.dev/gemini-api/docs/models
Trang model được cập nhật 2026-08-05. Các endpoint text ổn định đang liệt kê gồm `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`; Gemini 2.5 Flash và Gemini 2.5 Flash-Lite cũng còn được liệt kê. Trang ghi `gemini-2.0-flash` và `gemini-2.0-flash-lite` đã shut down, vì vậy không nên dùng chúng làm mặc định OpenRouter/Gemini.

Nguồn chính thức: https://ai.google.dev/gemini-api/docs/rate-limits
Trang cập nhật 2026-07-21. Free tier vẫn tồn tại, nhưng giới hạn RPM/TPM/RPD phụ thuộc project/model và xem trong AI Studio; preview/experimental bị giới hạn chặt hơn. Không nên cam kết một mức quota cố định trong UI.

## Groq
Nguồn chính thức: https://console.groq.com/docs/models
Danh sách đang công bố gồm `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, cùng hệ thống `groq/compound` và `groq/compound-mini`. Endpoint tương thích OpenAI là `https://api.groq.com/openai/v1`. Trang cho phép gọi `/models` để lấy danh sách hoạt động, nên catalog tĩnh cần có fallback/khả năng tự nhập model.

## OpenRouter
Nguồn chính thức: https://openrouter.ai/collections/free-models
Trang ghi bảng free models được cập nhật tháng 8/2026 và giới thiệu router động `openrouter/free`, tự chọn trong các model miễn phí hiện có. Model free thay đổi theo thời gian, nên ưu tiên `openrouter/free` làm mặc định và cho phép người dùng tự nhập model ID; không nên cố định các model cũ như `google/gemini-2.0-flash-exp:free`.

## Quyết định triển khai
Giữ các provider Gemini, Groq, OpenRouter và OpenAI-compatible. Cập nhật catalog sang model hiện hành; đặt OpenRouter mặc định `openrouter/free`; thêm trường model tùy biến và nút nạp model từ endpoint `/models` khi provider hỗ trợ. Giữ thông báo free tier có điều kiện, không cam kết quota cố định.

## References
[1]: https://ai.google.dev/gemini-api/docs/models
[2]: https://ai.google.dev/gemini-api/docs/rate-limits
[3]: https://console.groq.com/docs/models
[4]: https://openrouter.ai/collections/free-models
