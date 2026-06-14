require "test_helper"

module Typing
  class TextNormalizerTest < ActiveSupport::TestCase
    test "normalizes prose into lowercase typing text" do
      assert_equal(
        "cafe au lait 42 times",
        TextNormalizer.call("Café au lait — 42 times!")
      )
    end

    test "collapses repeated whitespace and punctuation" do
      assert_equal(
        "hello world again",
        TextNormalizer.call(" Hello,   world... again? ")
      )
    end
  end
end
