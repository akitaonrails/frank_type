require "test_helper"

module Typing
  class ExcerptCatalogTest < ActiveSupport::TestCase
    test "loads attributed normalized excerpts" do
      excerpts = ExcerptCatalog.all

      assert_not_empty excerpts
      assert excerpts.all? { |excerpt| excerpt.id.present? }
      assert excerpts.all? { |excerpt| excerpt.source_url.start_with?("https://www.gutenberg.org/ebooks/") }
      assert excerpts.all? { |excerpt| excerpt.normalized_text.match?(/\A[a-z0-9 ]+\z/) }
      assert excerpts.all? { |excerpt| excerpt.word_count.positive? }
    end

    test "exports browser-safe json without original prose payload" do
      payload = ExcerptCatalog.as_json

      assert_not_empty payload
      assert_not payload.first.key?(:original_text)
      assert payload.first.key?(:normalized_text)
    end
  end
end
