require "test_helper"

class PagesControllerTest < ActionDispatch::IntegrationTest
  test "home renders typing practice" do
    get root_url

    assert_response :success
    assert_select "[data-controller='typing']"
    assert_select "h1", text: /Real prose/
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
end
