require "test_helper"

module Typing
  class ExcerptCatalogTest < ActiveSupport::TestCase
    test "loads attributed normalized excerpts" do
      excerpts = ExcerptCatalog.all

      assert_not_empty excerpts
      assert excerpts.all? { |excerpt| excerpt.id.present? }
      assert excerpts.any? { |excerpt| excerpt.author == "Isaac Asimov" }
      assert_equal [ "en", "pt-BR" ], excerpts.map(&:language).uniq.sort
      assert_equal [ "biography", "fantasy", "scifi" ], excerpts.map(&:category).uniq.sort
      assert excerpts.all? { |excerpt| excerpt.source.match?(/Project Gutenberg ebook #\d+/) }
      assert_equal [ "fast", "medium", "slow" ], excerpts.map(&:speed_band).uniq.sort
      assert excerpts.all? { |excerpt| excerpt.source_url.start_with?("https://www.gutenberg.org/ebooks/") }
      assert excerpts.select { |excerpt| excerpt.language == "en" }.all? { |excerpt| excerpt.normalized_text.match?(/\A[a-z0-9 ]+\z/) }
      assert excerpts.select { |excerpt| excerpt.language == "pt-BR" }.all? { |excerpt| excerpt.normalized_text.match?(/\A[\p{L}\p{N} ]+\z/) }
      assert excerpts.all? { |excerpt| excerpt.word_count >= 70 }
      assert excerpts.group_by { |excerpt| [ excerpt.language, excerpt.category, excerpt.speed_band ] }.values.all? { |group| group.size >= 10 }
    end

    test "exports browser-safe json without original prose payload" do
      payload = ExcerptCatalog.as_json

      assert_not_empty payload
      assert_not payload.first.key?(:original_text)
      assert payload.first.key?(:normalized_text)
      assert payload.first.key?(:language)
      assert payload.first.key?(:category)
      assert payload.first.key?(:speed_band)
    end

    test "exports excerpts for the requested locale" do
      payload = ExcerptCatalog.as_json(locale: :"pt-BR")

      assert_not_empty payload
      assert_equal [ "pt-BR" ], payload.map { |excerpt| excerpt.fetch(:language) }.uniq
      assert payload.any? { |excerpt| excerpt.fetch(:author) == "Machado de Assis" }
      assert payload.any? { |excerpt| excerpt.fetch(:normalized_text).match?(/[áàâãéêíóôõúç]/) }
    end

    test "falls back to english excerpts for unsupported locales" do
      payload = ExcerptCatalog.as_json(locale: :fr)

      assert_not_empty payload
      assert_equal [ "en" ], payload.map { |excerpt| excerpt.fetch(:language) }.uniq
    end
  end
end
