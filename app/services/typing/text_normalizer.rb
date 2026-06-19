module Typing
  class TextNormalizer
    def self.call(text, locale: I18n.locale)
      new(text, locale: locale).call
    end

    def initialize(text, locale: I18n.locale)
      @text = text.to_s
      @locale = locale.to_s.presence || I18n.default_locale.to_s
    end

    def call
      return normalize_portuguese if @locale == "pt-BR"

      normalize_english
    end

    private

    def normalize_english
      @text
        .unicode_normalize(:nfkc)
        .then { |value| I18n.transliterate(value) }
        .downcase
        .gsub(/[^a-z0-9\s]/, " ")
        .squeeze(" ")
        .strip
    end

    def normalize_portuguese
      @text
        .unicode_normalize(:nfc)
        .downcase
        .gsub(/[^\p{L}\p{N}\s]/, " ")
        .gsub(/\s+/, " ")
        .strip
    end
  end
end
