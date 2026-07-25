package com.example.yugm.di

import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.api.YugmApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideYugmApi(): IYugmApi = YugmApi
}
