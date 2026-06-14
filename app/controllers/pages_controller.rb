class PagesController < ApplicationController
  def home
  end

  def profile
  end

  def sources
    @excerpts = Typing::ExcerptCatalog.all(locale: I18n.locale)
  end
end
