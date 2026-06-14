module Typing
  Excerpt = Data.define(
    :id,
    :title,
    :author,
    :source,
    :source_url,
    :original_text,
    :normalized_text,
    :difficulty,
    :word_count,
    :character_count
  )

  class ExcerptCatalog
    class << self
      def all
        records.map { |attributes| build_excerpt(attributes) }
      end

      def as_json
        all.map { |excerpt| excerpt.to_h.except(:original_text) }
      end

      private

      def records
        Rails.cache.fetch("typing/excerpt_catalog/v1") do
          YAML.load_file(Rails.root.join("config/typing_excerpts.yml"))
        end
      end

      def build_excerpt(attributes)
        normalized_text = TextNormalizer.call(attributes.fetch("text"))

        Excerpt.new(
          id: attributes.fetch("id"),
          title: attributes.fetch("title"),
          author: attributes.fetch("author"),
          source: attributes.fetch("source"),
          source_url: attributes.fetch("source_url"),
          original_text: attributes.fetch("text"),
          normalized_text: normalized_text,
          difficulty: difficulty_for(normalized_text),
          word_count: normalized_text.split.size,
          character_count: normalized_text.length
        )
      end

      def difficulty_for(text)
        words = text.split
        return "easy" if words.empty?

        average_word_length = words.sum(&:length).fdiv(words.size)
        long_word_ratio = words.count { |word| word.length >= 8 }.fdiv(words.size)

        if average_word_length >= 5.2 || long_word_ratio >= 0.2
          "hard"
        elsif average_word_length >= 4.5 || long_word_ratio >= 0.12
          "medium"
        else
          "easy"
        end
      end
    end
  end
end
