require "test_helper"

class PagesControllerTest < ActionDispatch::IntegrationTest
  test "home renders typing practice" do
    get root_url

    assert_response :success
    assert_select "[data-controller='typing']"
    assert_includes response.body, "data-typing-excerpts-value=\"[{&quot;"
    assert_not_includes response.body, "&amp;quot;"
    assert_select "[aria-label='Category']"
    assert_select "[data-typing-target='slowPairPanel']"
    assert_select "[role='dialog'][aria-labelledby='typing-help-title']"
    assert_select "#typing-help-title", text: "Shortcuts"
    assert_select "a[href='/?locale=pt-BR']", text: "Português"
  end

  test "profile renders local dashboard" do
    get profile_url

    assert_response :success
    assert_select "[data-controller='profile']"
  end

  test "sources render excerpt attribution" do
    get sources_url

    assert_response :success
    assert_select "article", minimum: 1
    assert_select "a[href^='https://www.gutenberg.org/ebooks/']", minimum: 1
  end

  test "browser portuguese locale is detected and stored" do
    get root_url, headers: { "Accept-Language" => "pt-BR,pt;q=0.9,en;q=0.8" }

    assert_response :success
    assert_select "html[lang='pt-BR']"
    assert_select "#typing-help-title", text: "Atalhos"
    assert_includes response.body, "&quot;language&quot;:&quot;pt-BR&quot;"
    assert_not_includes response.body, "&quot;language&quot;:&quot;en&quot;"
    assert_equal "pt-BR", cookies[:locale]
  end

  test "unsupported locales fall back to english" do
    get root_url, headers: { "Accept-Language" => "fr-FR,fr;q=0.9" }

    assert_response :success
    assert_select "html[lang='en']"
    assert_select "#typing-help-title", text: "Shortcuts"
    assert_equal "en", cookies[:locale]
  end

  test "locale query parameter overrides cookie" do
    cookies[:locale] = "pt-BR"

    get root_url(locale: "fr-FR")

    assert_response :success
    assert_select "html[lang='en']"
    assert_equal "en", cookies[:locale]
  end
end
