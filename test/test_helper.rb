ENV["RAILS_ENV"] ||= "test"

if ENV["COVERAGE"] == "true"
  require "simplecov"

  SimpleCov.start "rails" do
    enable_coverage :branch
    skip "/test/"

    group "Controllers", "app/controllers"
    group "Services", "app/services"

    minimum_coverage line: 85, branch: 70
  end
end

require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    teardown do
      I18n.locale = I18n.default_locale
    end

    # Add more helper methods to be used by all tests here...
  end
end
